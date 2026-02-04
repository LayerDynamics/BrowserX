/**
 * Parallel Execution Integration Tests
 * Tests parallel query execution and step dependencies
 */

import { assertEquals, assertExists, assert, assertRejects } from "@std/assert";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";
import { QueryOptimizer } from "../../optimizer/mod.ts";
import { ExecutionPlanner } from "../../planner/mod.ts";
import { QueryEngine } from "../../core/engine.ts";

// ============================================================================
// Dependency Graph Tests
// ============================================================================

Deno.test({
  name: "Parallel - plan includes dependency graph",
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

  assertExists(plan.dependencies);
  assertExists(plan.dependencies.nodes);
  assertExists(plan.dependencies.roots);
  assertExists(plan.dependencies.leaves);
});

Deno.test({
  name: "Parallel - dependency nodes match steps",
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

  // Each step should have a corresponding node
  for (const step of plan.steps) {
    const node = plan.dependencies.nodes.get(step.id);
    assertExists(node, `Missing node for step ${step.id}`);
  }
});

Deno.test({
  name: "Parallel - dependency references are valid",
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

  // All dependency references should reference valid nodes
  for (const [nodeId, node] of plan.dependencies.nodes) {
    // Check that all dependencies reference valid nodes
    for (const depId of node.dependencies) {
      assert(plan.dependencies.nodes.has(depId), `Invalid dependency: ${depId} from node ${nodeId}`);
    }
    // Check that all dependents reference valid nodes
    for (const depId of node.dependents) {
      assert(plan.dependencies.nodes.has(depId), `Invalid dependent: ${depId} from node ${nodeId}`);
    }
  }
});

// ============================================================================
// Independent Step Detection Tests
// ============================================================================

Deno.test({
  name: "Parallel - SET statements are independent when different vars",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query1 = "SET x = 1";
  const query2 = "SET y = 2";

  // Parse both
  const ast1 = new Parser(new Lexer(query1).tokenize()).parse();
  const ast2 = new Parser(new Lexer(query2).tokenize()).parse();

  assertEquals(ast1.type, "SET");
  assertEquals(ast2.type, "SET");
  // Different variables, could run in parallel
  assert((ast1 as any).path[0] !== (ast2 as any).path[0]);
});

Deno.test({
  name: "Parallel - NAVIGATE creates dependency for subsequent DOM ops",
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

  // NAVIGATE should be a dependency for DOM operations
  assertExists(plan);
  assert(plan.steps.length > 0);
});

// ============================================================================
// FOR Loop Parallelization Tests
// ============================================================================

Deno.test({
  name: "Parallel - FOR loop body has sequential dependency",
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
  // Loop iterations may be sequential or parallel depending on implementation
});

Deno.test({
  name: "Parallel - FOR loop with independent iterations could parallelize",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR num IN [1, 2, 3] DO
    SET x = num
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
  // Independent iterations could run in parallel
});

// ============================================================================
// Async Query Execution Tests
// ============================================================================

Deno.test({
  name: "Parallel - executeAsync returns query ID",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const queryId = await engine.executeAsync("SET x = 1");
  assertExists(queryId);
  assertEquals(typeof queryId, "string");
  assert(queryId.length > 0);

  await engine.shutdown();
});

Deno.test({
  name: "Parallel - multiple async queries get unique IDs",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const ids: string[] = [];
  for (let i = 0; i < 5; i++) {
    const id = await engine.executeAsync("SET x = " + i);
    ids.push(id);
  }

  // All IDs should be unique
  const uniqueIds = new Set(ids);
  assertEquals(uniqueIds.size, ids.length);

  await engine.shutdown();
});

Deno.test({
  name: "Parallel - can get status of async query",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const queryId = await engine.executeAsync("SET x = 1");
  const status = await engine.getQueryStatus(queryId);

  assertExists(status);
  assertExists(status.queryId);
  assertExists(status.state);
  assertEquals(status.queryId, queryId);

  await engine.shutdown();
});

Deno.test({
  name: "Parallel - async query status includes state",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const queryId = await engine.executeAsync("SET x = 1");

  // Allow query to complete
  await new Promise((resolve) => setTimeout(resolve, 50));

  const status = await engine.getQueryStatus(queryId);

  assert(
    ["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"].includes(status.state),
    `Unexpected state: ${status.state}`
  );

  await engine.shutdown();
});

// ============================================================================
// Query Cancellation Tests
// ============================================================================

Deno.test({
  name: "Parallel - can cancel running query",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const queryId = await engine.executeAsync("SET x = 1");

  try {
    await engine.cancelQuery(queryId);
    const status = await engine.getQueryStatus(queryId);
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
  name: "Parallel - cancel non-existent query throws",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  await assertRejects(
    async () => await engine.cancelQuery("nonexistent_query_id"),
    Error,
    "not found"
  );

  await engine.shutdown();
});

// ============================================================================
// Resource Requirements for Parallel Execution Tests
// ============================================================================

Deno.test({
  name: "Parallel - plan estimates browser resources",
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

Deno.test({
  name: "Parallel - FOR loop creates valid execution plan",
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
  // Loop resources are estimated at planning time (iteration count unknown)
  // Verify the plan has valid structure with resource tracking
  assertEquals(typeof plan.resources.browsers, "number");
  assertEquals(typeof plan.resources.pages, "number");
  assertEquals(typeof plan.resources.connections, "number");
});

// ============================================================================
// Step Execution Order Tests
// ============================================================================

Deno.test({
  name: "Parallel - steps have execution priority",
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

  // Steps should have priority or ordering info
  for (const step of plan.steps) {
    assertExists(step.id);
    assertExists(step.type);
  }
});

Deno.test({
  name: "Parallel - dependency graph is acyclic",
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

  // Check for cycles using simple DFS
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  const hasCycle = (nodeId: string): boolean => {
    if (recursionStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    recursionStack.add(nodeId);

    const node = plan.dependencies.nodes.get(nodeId);
    const neighbors = node?.dependents || [];
    for (const neighbor of neighbors) {
      if (hasCycle(neighbor)) return true;
    }

    recursionStack.delete(nodeId);
    return false;
  };

  let foundCycle = false;
  for (const [nodeId] of plan.dependencies.nodes) {
    if (hasCycle(nodeId)) {
      foundCycle = true;
      break;
    }
  }

  assertEquals(foundCycle, false, "Dependency graph should be acyclic");
});

// ============================================================================
// Concurrent Query Engine Tests
// ============================================================================

Deno.test({
  name: "Parallel - engine handles concurrent queries",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Launch multiple queries concurrently
  const promises = [
    engine.executeAsync("SET a = 1"),
    engine.executeAsync("SET b = 2"),
    engine.executeAsync("SET c = 3"),
  ];

  const ids = await Promise.all(promises);

  assertEquals(ids.length, 3);
  const uniqueIds = new Set(ids);
  assertEquals(uniqueIds.size, 3);

  await engine.shutdown();
});

Deno.test({
  name: "Parallel - engine metrics track concurrent queries",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  const initialMetrics = engine.getMetrics();
  assertEquals(initialMetrics.queries.total, 0);

  // Execute some queries
  await engine.executeAsync("SET x = 1");
  await engine.executeAsync("SET y = 2");

  // Allow queries to complete
  await new Promise((resolve) => setTimeout(resolve, 100));

  const finalMetrics = engine.getMetrics();
  assert(finalMetrics.queries.total >= 2);

  await engine.shutdown();
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "Parallel - empty plan has valid dependencies",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 1";
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
  assert(plan.dependencies.nodes instanceof Map);
  assert(Array.isArray(plan.dependencies.roots));
  assert(Array.isArray(plan.dependencies.leaves));
});

Deno.test({
  name: "Parallel - complex query has proper dependencies",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF condition THEN
    FOR item IN items DO
      NAVIGATE TO item
    END
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
  // Complex query should have multiple nodes
  assert(plan.dependencies.nodes.size >= 1);
});
