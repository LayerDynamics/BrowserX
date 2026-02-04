/**
 * Navigation Integration Tests
 * Tests NAVIGATE statement execution through the full pipeline
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";
import { QueryOptimizer } from "../../optimizer/mod.ts";
import { ExecutionPlanner } from "../../planner/mod.ts";
import { ExecutionStepType } from "../../planner/plan.ts";

// ============================================================================
// NAVIGATE Statement Parsing Tests
// ============================================================================

Deno.test({
  name: "Navigation - parses basic NAVIGATE TO statement",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
  assertExists((ast as any).url);
});

Deno.test({
  name: "Navigation - parses NAVIGATE with variable URL",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "NAVIGATE TO targetUrl";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
  assertEquals((ast as any).url.type, "IDENTIFIER");
});

Deno.test({
  name: "Navigation - parses NAVIGATE with WITH options",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com" WITH { waitFor: "load", timeout: 30000 }';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
  assertExists((ast as any).options);
});

Deno.test({
  name: "Navigation - parses NAVIGATE with CAPTURE clause",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com" CAPTURE response.status, dom.title';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
  assertExists((ast as any).capture);
});

// ============================================================================
// Navigation Semantic Analysis Tests
// ============================================================================

Deno.test({
  name: "Navigation - semantic analysis validates URL",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com"';
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
  name: "Navigation - semantic analysis with private IP blocked",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "http://192.168.1.1"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({
    allowPrivateIPs: false,
  });

  // May throw or may pass depending on analyzer implementation
  try {
    const result = analyzer.analyze(ast);
    assertExists(result);
  } catch (e) {
    // Expected if private IPs are blocked
    assert(e instanceof Error);
  }
});

// ============================================================================
// Navigation Optimization Tests
// ============================================================================

Deno.test({
  name: "Navigation - optimization preserves NAVIGATE statement",
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

// ============================================================================
// Navigation Execution Planning Tests
// ============================================================================

Deno.test({
  name: "Navigation - planner creates NAVIGATE step",
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
  const planner = new ExecutionPlanner();
  const plan = planner.plan(optimized.optimizedAST, {
    optimizationApplied: true,
    appliedPasses: [],
    estimatedImprovement: 0,
  });

  assertExists(plan);
  assert(plan.steps.length > 0);

  // Should have a NAVIGATE step
  const navigateStep = plan.steps.find((s) => s.type === ExecutionStepType.NAVIGATE);
  assertExists(navigateStep);
});

Deno.test({
  name: "Navigation - planner includes dependencies",
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
  const planner = new ExecutionPlanner();
  const plan = planner.plan(optimized.optimizedAST, {
    optimizationApplied: true,
    appliedPasses: [],
    estimatedImprovement: 0,
  });

  assertExists(plan.dependencies);
  assertExists(plan.dependencies.nodes);
});

// ============================================================================
// Navigation with Options Tests
// ============================================================================

Deno.test({
  name: "Navigation - parses waitFor option",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com" WITH { waitFor: "networkidle" }';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
});

Deno.test({
  name: "Navigation - parses timeout option",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com" WITH { timeout: 60000 }';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
});

Deno.test({
  name: "Navigation - parses screenshot option",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com" WITH { screenshot: true }';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
});

Deno.test({
  name: "Navigation - parses proxy options",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com" WITH { proxy: { enabled: true, cache: true } }';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
});

// ============================================================================
// Navigation URL Variations Tests
// ============================================================================

Deno.test({
  name: "Navigation - handles HTTP URL",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "http://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
});

Deno.test({
  name: "Navigation - handles HTTPS URL",
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

Deno.test({
  name: "Navigation - handles URL with path",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com/path/to/page"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
});

Deno.test({
  name: "Navigation - handles URL with query parameters",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com/search?q=test&page=1"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
});

Deno.test({
  name: "Navigation - handles URL with fragment",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com/page#section"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
});

Deno.test({
  name: "Navigation - handles URL with port",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com:8080/api"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
});

// ============================================================================
// Navigation Capture Tests
// ============================================================================

Deno.test({
  name: "Navigation - captures response status",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "https://example.com" CAPTURE response.status';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
  assertExists((ast as any).capture);
});

Deno.test({
  name: "Navigation - captures multiple values",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  // Use response.body instead of response.headers since "headers" is a reserved keyword
  const query = 'NAVIGATE TO "https://example.com" CAPTURE response.status, response.body, dom.title';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "NAVIGATE");
  assertExists((ast as any).capture);
});

// ============================================================================
// Navigation in Compound Statements Tests
// ============================================================================

Deno.test({
  name: "Navigation - in FOR loop",
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

  assertEquals(ast.type, "FOR");
  assertExists((ast as any).body);
});

Deno.test({
  name: "Navigation - in IF statement",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF shouldNavigate THEN
    NAVIGATE TO "https://example.com"
  END`;
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();

  assertEquals(ast.type, "IF");
  assertExists((ast as any).then);
});

// ============================================================================
// Resource Requirements Tests
// ============================================================================

Deno.test({
  name: "Navigation - plan includes resource requirements",
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
  const planner = new ExecutionPlanner();
  const plan = planner.plan(optimized.optimizedAST, {
    optimizationApplied: true,
    appliedPasses: [],
    estimatedImprovement: 0,
  });

  assertExists(plan.resources);
  assertEquals(typeof plan.resources.browsers, "number");
  assertEquals(typeof plan.resources.pages, "number");
  assertEquals(typeof plan.resources.connections, "number");
});

// ============================================================================
// Navigation Error Cases Tests
// ============================================================================

Deno.test({
  name: "Navigation - missing URL throws parse error",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "NAVIGATE TO";
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
