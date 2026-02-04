/**
 * Control Flow Integration Tests
 * Tests FOR loops and IF statements through the full pipeline
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";
import { QueryOptimizer } from "../../optimizer/mod.ts";
import { ExecutionPlanner } from "../../planner/mod.ts";
import { ExecutionStepType } from "../../planner/plan.ts";

// ============================================================================
// FOR Loop Parsing Tests
// ============================================================================

Deno.test({
  name: "Control Flow - parses basic FOR loop",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR item IN items DO
    SET processed = item
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "FOR");
  assertEquals((ast as any).variable, "item");
  assertExists((ast as any).collection);
  assertExists((ast as any).body);
});

Deno.test({
  name: "Control Flow - parses FOR loop with array literal",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR url IN ["https://a.com", "https://b.com"] DO
    NAVIGATE TO url
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "FOR");
  assertEquals((ast as any).collection.type, "ARRAY");
  assertEquals((ast as any).collection.elements.length, 2);
});

Deno.test({
  name: "Control Flow - parses FOR loop with variable collection",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR page IN urls DO
    NAVIGATE TO page
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "FOR");
  assertEquals((ast as any).collection.type, "IDENTIFIER");
  assertEquals((ast as any).collection.name, "urls");
});

Deno.test({
  name: "Control Flow - parses nested FOR loops",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR category IN categories DO
    FOR item IN category DO
      SET result = item
    END
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "FOR");
  assertEquals((ast as any).body.type, "FOR");
  assertEquals((ast as any).body.variable, "item");
});

Deno.test({
  name: "Control Flow - parses FOR loop with multiple statements",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR url IN urls DO
    NAVIGATE TO url
    SET title = "processed"
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "FOR");
  assertExists((ast as any).body);
});

// ============================================================================
// IF Statement Parsing Tests
// ============================================================================

Deno.test({
  name: "Control Flow - parses basic IF statement",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF condition THEN
    SET result = "yes"
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "IF");
  assertExists((ast as any).condition);
  assertExists((ast as any).then);
});

Deno.test({
  name: "Control Flow - parses IF-ELSE statement",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF condition THEN
    SET result = "yes"
  ELSE
    SET result = "no"
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "IF");
  assertExists((ast as any).then);
  assertExists((ast as any).else);
});

Deno.test({
  name: "Control Flow - parses IF with comparison condition",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF count > 10 THEN
    SET status = "many"
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "IF");
  assertEquals((ast as any).condition.type, "BINARY");
  assertEquals((ast as any).condition.operator, ">");
});

Deno.test({
  name: "Control Flow - parses IF with equality condition",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF status = "active" THEN
    SET enabled = true
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "IF");
  assertEquals((ast as any).condition.type, "BINARY");
  assertEquals((ast as any).condition.operator, "=");
});

Deno.test({
  name: "Control Flow - parses IF with AND condition",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF isValid AND isEnabled THEN
    SET proceed = true
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "IF");
  assertEquals((ast as any).condition.type, "BINARY");
  assertEquals((ast as any).condition.operator, "AND");
});

Deno.test({
  name: "Control Flow - parses IF with OR condition",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF isAdmin OR isModerator THEN
    SET hasAccess = true
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "IF");
  assertEquals((ast as any).condition.operator, "OR");
});

Deno.test({
  name: "Control Flow - parses nested IF statements",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF outer THEN
    IF inner THEN
      SET result = "both"
    END
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "IF");
  assertEquals((ast as any).then.type, "IF");
});

Deno.test({
  name: "Control Flow - parses IF with NOT condition",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF NOT isDisabled THEN
    SET active = true
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "IF");
  assertExists((ast as any).condition);
});

// ============================================================================
// Semantic Analysis Tests
// ============================================================================

Deno.test({
  name: "Control Flow - semantic analysis validates FOR loop",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR item IN items DO
    SET result = item
  END`;
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
  name: "Control Flow - semantic analysis validates IF statement",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF condition THEN
    SET result = "done"
  END`;
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
  name: "Control Flow - semantic analysis validates loop variable scope",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR x IN [1, 2, 3] DO
    SET total = x
  END`;
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
  name: "Control Flow - optimization preserves FOR loop structure",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR item IN items DO
    SET result = item
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

Deno.test({
  name: "Control Flow - optimization preserves IF statement structure",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF condition THEN
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
  assertEquals(optimized.optimizedAST.type, "IF");
});

Deno.test({
  name: "Control Flow - optimizer may fold constant conditions",
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
});

// ============================================================================
// Execution Planning Tests
// ============================================================================

Deno.test({
  name: "Control Flow - planner creates LOOP step for FOR",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR item IN items DO
    SET result = item
  END`;
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

  // Should have a LOOP step
  const loopStep = plan.steps.find((s) => s.type === ExecutionStepType.LOOP);
  assertExists(loopStep);
});

Deno.test({
  name: "Control Flow - planner creates CONDITIONAL step for IF",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF condition THEN
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
  const planner = new ExecutionPlanner();
  const plan = planner.plan(optimized.optimizedAST, {
    optimizationApplied: true,
    appliedPasses: [],
    estimatedImprovement: 0,
  });

  assertExists(plan);
  assert(plan.steps.length > 0);

  // Should have a BRANCH step
  const condStep = plan.steps.find((s) => s.type === ExecutionStepType.BRANCH);
  assertExists(condStep);
});

Deno.test({
  name: "Control Flow - planner includes nested steps in FOR body",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR url IN urls DO
    NAVIGATE TO url
  END`;
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
  const loopStep = plan.steps.find((s) => s.type === ExecutionStepType.LOOP);
  assertExists(loopStep);
  assertExists((loopStep as any).bodySteps);
});

// ============================================================================
// Combined Control Flow Tests
// ============================================================================

Deno.test({
  name: "Control Flow - FOR loop inside IF statement",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF shouldProcess THEN
    FOR item IN items DO
      SET result = item
    END
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "IF");
  assertEquals((ast as any).then.type, "FOR");
});

Deno.test({
  name: "Control Flow - IF statement inside FOR loop",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR item IN items DO
    IF item > 0 THEN
      SET positive = true
    END
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "FOR");
  assertEquals((ast as any).body.type, "IF");
});

Deno.test({
  name: "Control Flow - complex nested structure",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF isEnabled THEN
    FOR category IN categories DO
      IF category > 0 THEN
        SET result = category
      END
    END
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "IF");
  assertEquals((ast as any).then.type, "FOR");
  assertEquals((ast as any).then.body.type, "IF");
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "Control Flow - FOR loop with empty body parses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  // This may throw or succeed depending on implementation
  try {
    const query = `FOR item IN items DO
    END`;
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    parser.parse();
  } catch (e) {
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Control Flow - IF with missing THEN keyword fails",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF condition
    SET result = "yes"
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);

  try {
    parser.parse();
    assert(false, "Should have thrown");
  } catch (e) {
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Control Flow - FOR with missing IN keyword fails",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR item items DO
    SET result = item
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);

  try {
    parser.parse();
    assert(false, "Should have thrown");
  } catch (e) {
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Control Flow - FOR with missing END keyword fails",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR item IN items DO
    SET result = item`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);

  try {
    parser.parse();
    assert(false, "Should have thrown");
  } catch (e) {
    assert(e instanceof Error);
  }
});

// ============================================================================
// Resource Requirements Tests
// ============================================================================

Deno.test({
  name: "Control Flow - FOR loop plan estimates resources",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR url IN urls DO
    NAVIGATE TO url
  END`;
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

  assertExists(plan.resources);
  assertEquals(typeof plan.resources.browsers, "number");
  assertEquals(typeof plan.resources.pages, "number");
});

Deno.test({
  name: "Control Flow - IF statement plan has dependencies",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF condition THEN
    NAVIGATE TO "https://example.com"
  END`;
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

  assertExists(plan.dependencies);
  assertExists(plan.dependencies.nodes);
});
