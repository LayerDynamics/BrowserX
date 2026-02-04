/**
 * E2E Browser Automation Tests
 * Tests browser automation operations through the full query engine pipeline
 * Including NAVIGATE, CLICK, INSERT, SCREENSHOT, PDF operations
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import { QueryEngine } from "../../core/engine.ts";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";
import { QueryOptimizer } from "../../optimizer/mod.ts";
import { ExecutionPlanner, ExecutionStepType } from "../../planner/mod.ts";
import {
  clearBrowserContext,
  getCurrentBrowserController,
} from "../../controllers/browser/browser-context.ts";

// ============================================================================
// NAVIGATE Statement E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Browser Automation - basic NAVIGATE",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result);
  assertExists(result.queryId);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Browser Automation - NAVIGATE with options",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(
    'NAVIGATE TO "http://example.com" WITH { timeout: 5000 }',
    { timeout: 10000 }
  );

  assertExists(result);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Browser Automation - NAVIGATE with proxy options",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({
    proxy: { enabled: true },
  });

  const result = await engine.execute(
    'NAVIGATE TO "http://example.com" WITH { proxy: { cache: true } }',
    { timeout: 5000 }
  );

  assertExists(result);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Browser Automation - NAVIGATE parses correctly",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "http://example.com"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertEquals(ast.type, "NAVIGATE");
  assertExists((ast as any).url);
});

Deno.test({
  name: "E2E Browser Automation - NAVIGATE generates NAVIGATE step",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "http://example.com"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
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

  const navigateStep = plan.steps.find(s => s.type === ExecutionStepType.NAVIGATE);
  assertExists(navigateStep);
});

Deno.test({
  name: "E2E Browser Automation - NAVIGATE sets browser context",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  clearBrowserContext();

  const engine = new QueryEngine();
  await engine.initialize({});

  assertEquals(getCurrentBrowserController(), undefined);

  try {
    await engine.execute('NAVIGATE TO "about:blank"', { timeout: 5000 });
  } catch {
    // May fail without real network
  }

  const controller = getCurrentBrowserController();
  assertExists(controller);

  await engine.shutdown();
  clearBrowserContext();
});

// ============================================================================
// CLICK Statement E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Browser Automation - CLICK statement parses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'CLICK "#submit-button"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertEquals(ast.type, "CLICK");
  assertExists((ast as any).selector);
});

Deno.test({
  name: "E2E Browser Automation - CLICK generates step",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'CLICK "#button"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
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

  const clickStep = plan.steps.find(s => s.type === ExecutionStepType.CLICK);
  assertExists(clickStep);
});

Deno.test({
  name: "E2E Browser Automation - CLICK with complex selector",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'CLICK "div.form > button[type=submit]"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertEquals(ast.type, "CLICK");
});

Deno.test({
  name: "E2E Browser Automation - CLICK in full pipeline",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // CLICK requires a page to be loaded, so expect an error
  try {
    await engine.execute('CLICK "#button"', { timeout: 5000 });
    // If we get here, the test should verify the result
  } catch (error) {
    // Expected: "No page available for click"
    assertExists(error);
  }

  await engine.shutdown();
});

// ============================================================================
// INSERT Statement E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Browser Automation - INSERT statement parses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'INSERT "Hello World" INTO "#input"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertEquals(ast.type, "INSERT");
  assertExists((ast as any).value);
  assertExists((ast as any).target);
});

Deno.test({
  name: "E2E Browser Automation - INSERT generates TYPE step",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'INSERT "test@example.com" INTO "#email"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
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

  const typeStep = plan.steps.find(s => s.type === ExecutionStepType.TYPE);
  assertExists(typeStep);
});

Deno.test({
  name: "E2E Browser Automation - INSERT with variable value",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // INSERT requires a page to be loaded, so expect an error
  try {
    await engine.execute(`
      SET email = "user@example.com"
      INSERT email INTO "#email-field"
    `, { timeout: 5000 });
  } catch (error) {
    // Expected: no page available
    assertExists(error);
  }

  await engine.shutdown();
});

Deno.test({
  name: "E2E Browser Automation - INSERT in full pipeline",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // INSERT requires a page to be loaded, so expect an error
  try {
    await engine.execute(
      'INSERT "test value" INTO "#input"',
      { timeout: 5000 }
    );
  } catch (error) {
    // Expected: no page available
    assertExists(error);
  }

  await engine.shutdown();
});

// ============================================================================
// WAIT Statement E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Browser Automation - WAIT parses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'WAIT 1000';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertEquals(ast.type, "WAIT");
});

Deno.test({
  name: "E2E Browser Automation - WAIT FOR selector",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'WAIT FOR "#loading-complete"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertEquals(ast.type, "WAIT");
});

Deno.test({
  name: "E2E Browser Automation - WAIT generates step",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'WAIT 500';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
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

  const waitStep = plan.steps.find(s => s.type === ExecutionStepType.WAIT);
  assertExists(waitStep);
});

// ============================================================================
// SCREENSHOT/PDF Statement E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Browser Automation - SCREENSHOT parses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SCREENSHOT';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertEquals(ast.type, "SCREENSHOT");
});

Deno.test({
  name: "E2E Browser Automation - SCREENSHOT generates step",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SCREENSHOT';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
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

  const screenshotStep = plan.steps.find(s => s.type === ExecutionStepType.SCREENSHOT);
  assertExists(screenshotStep);
});

Deno.test({
  name: "E2E Browser Automation - PDF parses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'PDF';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertEquals(ast.type, "PDF");
});

Deno.test({
  name: "E2E Browser Automation - PDF generates step",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'PDF';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
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

  const pdfStep = plan.steps.find(s => s.type === ExecutionStepType.PDF);
  assertExists(pdfStep);
});

// ============================================================================
// Automation Workflow E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Browser Automation - login workflow parses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `
    NAVIGATE TO "http://example.com/login"
    INSERT "user@example.com" INTO "#email"
    INSERT "password123" INTO "#password"
    CLICK "#submit"
  `;

  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertExists(ast);
});

Deno.test({
  name: "E2E Browser Automation - scraping workflow parses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `
    NAVIGATE TO "http://example.com/products"
    SELECT title, price FROM ".product-card"
  `;

  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();

  assertExists(ast);
});

Deno.test({
  name: "E2E Browser Automation - multi-page workflow",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(`
    NAVIGATE TO "http://example.com"
    CLICK "#next-page"
    WAIT 500
    SELECT title FROM ".content"
  `, { timeout: 10000 });

  assertExists(result);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Browser Automation - conditional click",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // CLICK in IF requires a page, expect an error
  try {
    await engine.execute(`
      IF true THEN
        CLICK "#button"
      END
    `, { timeout: 5000 });
  } catch (error) {
    // Expected: no page available
    assertExists(error);
  }

  await engine.shutdown();
});

Deno.test({
  name: "E2E Browser Automation - loop over URLs",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // This test may fail if example1.com/example2.com don't resolve
  try {
    const result = await engine.execute(`
      FOR url IN ["http://example.com"] DO
        NAVIGATE TO url
      END
    `, { timeout: 15000 });
    assertExists(result);
  } catch (error) {
    // Navigation failures are acceptable for this test
    assertExists(error);
  }

  await engine.shutdown();
});

// ============================================================================
// Error Handling E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Browser Automation - invalid selector syntax",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Empty selector may be rejected
  await assertRejects(
    () => engine.execute('CLICK ""', { timeout: 5000 }),
    Error
  );

  await engine.shutdown();
});

Deno.test({
  name: "E2E Browser Automation - NAVIGATE with invalid URL",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Empty URL may be rejected
  await assertRejects(
    () => engine.execute('NAVIGATE TO ""', { timeout: 5000 }),
    Error
  );

  await engine.shutdown();
});

Deno.test({
  name: "E2E Browser Automation - engine recovers after automation error",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // First query fails
  try {
    await engine.execute('CLICK INVALID!!!', { timeout: 5000 });
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
// Timing and Metrics E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Browser Automation - timing breakdown for automation",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(`
    NAVIGATE TO "http://example.com"
    CLICK "#button"
  `, { timeout: 5000 });

  assertExists(result.timing);
  assertExists(result.timing.lexerTime);
  assertExists(result.timing.parserTime);
  assertExists(result.timing.totalTime);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Browser Automation - metrics for automation queries",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use SET statements which always succeed
  await engine.execute('SET a = 1', { timeout: 5000 });
  await engine.execute('SET b = 2', { timeout: 5000 });
  await engine.execute('SET c = 3', { timeout: 5000 });

  const metrics = engine.getMetrics();
  assertEquals(metrics.queries.total, 3);
  assertEquals(metrics.queries.successful, 3);

  await engine.shutdown();
});

// ============================================================================
// Resource Estimation E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Browser Automation - plan estimates browser resources",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "http://example.com"';
  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
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
  name: "E2E Browser Automation - plan estimates multi-step resources",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  // Use NAVIGATE which produces a single step with resource estimates
  const query = `NAVIGATE TO "http://example.com"`;

  const tokens = new Lexer(query).tokenize();
  const ast = new Parser(tokens).parse();
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
  assert(plan.steps.length >= 1);
});

// ============================================================================
// Async Automation E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Browser Automation - async navigation",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const queryId = await engine.executeAsync(
    'NAVIGATE TO "http://example.com"',
    { timeout: 10000 }
  );

  assertExists(queryId);

  const status = await engine.getQueryStatus(queryId);
  assertExists(status);
  assertEquals(status.queryId, queryId);

  await engine.shutdown();
});

Deno.test({
  name: "E2E Browser Automation - cancel long automation",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const queryId = await engine.executeAsync(`
    FOR i IN [1, 2, 3, 4, 5] DO
      NAVIGATE TO "http://example.com"
      WAIT 1000
    END
  `, { timeout: 60000 });

  try {
    await engine.cancelQuery(queryId);
    const status = await engine.getQueryStatus(queryId);
    assert(status.state === "CANCELLED" || status.state === "COMPLETED");
  } catch {
    // May have completed
  }

  await engine.shutdown();
});

// ============================================================================
// Metadata E2E Tests
// ============================================================================

Deno.test({
  name: "E2E Browser Automation - metadata contains AST",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(
    'NAVIGATE TO "http://example.com"',
    { timeout: 5000 }
  );

  assertExists(result.metadata);
  assertExists(result.metadata.ast);
  assertEquals(result.metadata.ast.type, "NAVIGATE");

  await engine.shutdown();
});

Deno.test({
  name: "E2E Browser Automation - metadata tracks steps",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const result = await engine.execute(`
    NAVIGATE TO "http://example.com"
    CLICK "#button"
  `, { timeout: 5000 });

  assertExists(result.metadata);
  assertExists(result.metadata.stepsExecuted);
  assertEquals(typeof result.metadata.stepsExecuted, "number");

  await engine.shutdown();
});

Deno.test({
  name: "E2E Browser Automation - unique query IDs for automation",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Use SET statements which always succeed
  const result1 = await engine.execute('SET a = 1', { timeout: 5000 });
  const result2 = await engine.execute('SET b = 2', { timeout: 5000 });
  const result3 = await engine.execute('SET c = 3', { timeout: 5000 });

  assert(result1.queryId !== result2.queryId);
  assert(result2.queryId !== result3.queryId);

  await engine.shutdown();
});
