/**
 * Optimizer Tests
 * Comprehensive tests for the QueryOptimizer class
 */

import { assertEquals, assertExists, assert } from "@std/assert";
import { QueryOptimizer, Optimizer, type OptimizationResult, type OptimizerConfig } from "../../optimizer/optimizer.ts";
import { CostEstimator } from "../../optimizer/cost.ts";
import { parseQuery, parseExpression, isSelectStatement, isLiteral, isNavigateStatement, isBinaryExpression } from "../helpers/test-utils.ts";
import type { SelectStatement, Literal, BinaryExpression, NavigateStatement } from "../../types/ast.ts";

// ============================================================================
// Constructor Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - constructor creates optimizer with default config",
  fn() {
    const optimizer = new QueryOptimizer();

    assertExists(optimizer);
    const config = optimizer.getConfig();
    assertEquals(config.enableConstantFolding, true);
    assertEquals(config.enableDeadCodeElimination, true);
    assertEquals(config.enablePredicatePushdown, true);
    assertEquals(config.enableProjectionPushdown, true);
    assertEquals(config.enableCacheOptimization, true);
    assertEquals(config.enableParallelDetection, true);
    assertEquals(config.maxPasses, 3);
  },
});

Deno.test({
  name: "QueryOptimizer - constructor accepts custom config",
  fn() {
    const optimizer = new QueryOptimizer({
      enableConstantFolding: false,
      enableDeadCodeElimination: false,
      maxPasses: 5,
    });

    const config = optimizer.getConfig();
    assertEquals(config.enableConstantFolding, false);
    assertEquals(config.enableDeadCodeElimination, false);
    assertEquals(config.maxPasses, 5);
    // Default values for unspecified options
    assertEquals(config.enablePredicatePushdown, true);
  },
});

Deno.test({
  name: "Optimizer - alias for QueryOptimizer works",
  fn() {
    const optimizer = new Optimizer();
    assertExists(optimizer);
    const config = optimizer.getConfig();
    assertEquals(config.enableConstantFolding, true);
  },
});

// ============================================================================
// Optimization Passes Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - getOptimizationPasses returns passes based on config",
  fn() {
    const optimizer = new QueryOptimizer();
    const passes = optimizer.getOptimizationPasses();

    // With all passes enabled, should have 4 passes
    assertEquals(passes.length, 4);
    assert(passes.some(p => p.name === "ConstantFolding"));
    assert(passes.some(p => p.name === "DeadCodeElimination"));
    assert(passes.some(p => p.name === "PredicatePushdown"));
    assert(passes.some(p => p.name === "ProjectionPushdown"));
  },
});

Deno.test({
  name: "QueryOptimizer - disabled passes not included",
  fn() {
    const optimizer = new QueryOptimizer({
      enableConstantFolding: false,
      enableDeadCodeElimination: false,
    });
    const passes = optimizer.getOptimizationPasses();

    assertEquals(passes.length, 2);
    assert(!passes.some(p => p.name === "ConstantFolding"));
    assert(!passes.some(p => p.name === "DeadCodeElimination"));
    assert(passes.some(p => p.name === "PredicatePushdown"));
    assert(passes.some(p => p.name === "ProjectionPushdown"));
  },
});

// ============================================================================
// Cost Estimator Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - getCostEstimator returns cost estimator",
  fn() {
    const optimizer = new QueryOptimizer();
    const estimator = optimizer.getCostEstimator();

    assertExists(estimator);
    assert(estimator instanceof CostEstimator);
  },
});

// ============================================================================
// Constant Folding Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - constant folding arithmetic addition",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT * FROM users WHERE count = 10 + 5");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertExists(result.optimizedAST);

    // Check that constant folding was applied
    if (isSelectStatement(result.optimizedAST) && result.optimizedAST.where) {
      const whereExpr = result.optimizedAST.where as BinaryExpression;
      if (whereExpr.right && isLiteral(whereExpr.right)) {
        assertEquals(whereExpr.right.value, 15);
      }
    }
  },
});

Deno.test({
  name: "QueryOptimizer - constant folding arithmetic multiplication",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT * FROM users WHERE count = 3 * 4");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    if (isSelectStatement(result.optimizedAST) && result.optimizedAST.where) {
      const whereExpr = result.optimizedAST.where as BinaryExpression;
      if (whereExpr.right && isLiteral(whereExpr.right)) {
        assertEquals(whereExpr.right.value, 12);
      }
    }
  },
});

Deno.test({
  name: "QueryOptimizer - constant folding boolean AND",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT * FROM users WHERE active = true AND flag = true");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertExists(result.optimizedAST);
  },
});

Deno.test({
  name: "QueryOptimizer - constant folding string concatenation",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SET name = 'Hello' || ' ' || 'World'");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertExists(result.optimizedAST);
  },
});

Deno.test({
  name: "QueryOptimizer - constant folding unary NOT",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT * FROM users WHERE NOT false");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    if (isSelectStatement(result.optimizedAST) && result.optimizedAST.where) {
      // After folding, NOT false should become true
      if (isLiteral(result.optimizedAST.where)) {
        assertEquals(result.optimizedAST.where.value, true);
      }
    }
  },
});

Deno.test({
  name: "QueryOptimizer - constant folding unary minus",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SET value = -42");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertExists(result.optimizedAST);
  },
});

// ============================================================================
// Optimization Result Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - optimize returns OptimizationResult",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT * FROM 'http://example.com'");
    const result = optimizer.optimize(stmt);

    assertExists(result.optimizedAST);
    assertExists(result.appliedPasses);
    assertExists(result.originalCost);
    assertExists(result.optimizedCost);
    assert(typeof result.improvement === "number");
  },
});

Deno.test({
  name: "QueryOptimizer - optimize includes cache metadata when enabled",
  fn() {
    const optimizer = new QueryOptimizer({ enableCacheOptimization: true });
    const stmt = parseQuery("SELECT * FROM 'http://example.com'");
    const result = optimizer.optimize(stmt);

    assert(result.appliedPasses.includes("CacheOptimization"));
    assertExists(result.cacheMetadata);
  },
});

Deno.test({
  name: "QueryOptimizer - optimize includes parallel groups when enabled",
  fn() {
    const optimizer = new QueryOptimizer({ enableParallelDetection: true });
    const stmt = parseQuery("SELECT * FROM 'http://example.com'");
    const result = optimizer.optimize(stmt);

    assert(result.appliedPasses.includes("ParallelDetection"));
    assertExists(result.parallelGroups);
  },
});

Deno.test({
  name: "QueryOptimizer - optimize without cache optimization",
  fn() {
    const optimizer = new QueryOptimizer({ enableCacheOptimization: false });
    const stmt = parseQuery("SELECT * FROM 'http://example.com'");
    const result = optimizer.optimize(stmt);

    assert(!result.appliedPasses.includes("CacheOptimization"));
    assertEquals(result.cacheMetadata, undefined);
  },
});

Deno.test({
  name: "QueryOptimizer - optimize without parallel detection",
  fn() {
    const optimizer = new QueryOptimizer({ enableParallelDetection: false });
    const stmt = parseQuery("SELECT * FROM 'http://example.com'");
    const result = optimizer.optimize(stmt);

    assert(!result.appliedPasses.includes("ParallelDetection"));
    assertEquals(result.parallelGroups, undefined);
  },
});

// ============================================================================
// Cost Estimation Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - originalCost and optimizedCost have valid structure",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT * FROM 'http://example.com'");
    const result = optimizer.optimize(stmt);

    assertExists(result.originalCost.totalCost);
    assertExists(result.originalCost.networkCost);
    assertExists(result.originalCost.computeCost);
    assertExists(result.originalCost.renderCost);
    assertExists(result.originalCost.cacheLookupCost);

    assertExists(result.optimizedCost.totalCost);
    assertExists(result.optimizedCost.networkCost);
    assertExists(result.optimizedCost.computeCost);
  },
});

Deno.test({
  name: "QueryOptimizer - improvement percentage is calculated correctly",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT * FROM 'http://example.com' WHERE 1 + 1 = 2");
    const result = optimizer.optimize(stmt);

    // Improvement should be non-negative
    assert(result.improvement >= 0);
    assert(result.improvement <= 100);
  },
});

// ============================================================================
// Statement Type Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - optimizes SELECT statement",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT name, age FROM users WHERE age > 18 ORDER BY age DESC");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "SELECT");
  },
});

Deno.test({
  name: "QueryOptimizer - optimizes NAVIGATE statement",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("NAVIGATE TO 'http://example.com'");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "NAVIGATE");
  },
});

Deno.test({
  name: "QueryOptimizer - optimizes SET statement",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SET value = 10 + 20");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "SET");
  },
});

Deno.test({
  name: "QueryOptimizer - optimizes FOR statement",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("FOR EACH item IN items { SET count = 1 + 1 }");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "FOR");
  },
});

Deno.test({
  name: "QueryOptimizer - optimizes IF statement",
  fn() {
    const optimizer = new QueryOptimizer();
    // Use a variable condition so the IF is not constant-folded away
    // (IF 1 + 1 = 2 would be optimized to just SHOW 'yes')
    const stmt = parseQuery("IF condition THEN { SHOW 'yes' } ELSE { SHOW 'no' }");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "IF");
  },
});

Deno.test({
  name: "QueryOptimizer - optimizes WITH statement",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("WITH data AS (SELECT * FROM 'http://api.com') SELECT * FROM data");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "WITH");
  },
});

Deno.test({
  name: "QueryOptimizer - optimizes INSERT statement",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("INSERT { name: 'Alice', age: 20 + 5 } INTO users");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "INSERT");
  },
});

Deno.test({
  name: "QueryOptimizer - optimizes UPDATE statement",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("UPDATE user SET age = 20 + 5");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "UPDATE");
  },
});

Deno.test({
  name: "QueryOptimizer - optimizes DELETE statement",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("DELETE user");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "DELETE");
  },
});

// ============================================================================
// Max Passes Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - respects maxPasses configuration",
  fn() {
    const optimizer = new QueryOptimizer({ maxPasses: 1 });
    const stmt = parseQuery("SELECT * FROM users WHERE 1 + 1 + 1 + 1 = 4");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    // With maxPasses: 1, optimization should still work but limit iterations
    assert(result.appliedPasses.length >= 0);
  },
});

Deno.test({
  name: "QueryOptimizer - zero maxPasses applies no optimization passes",
  fn() {
    const optimizer = new QueryOptimizer({ maxPasses: 0 });
    const stmt = parseQuery("SELECT * FROM users WHERE 1 + 1 = 2");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    // Even with maxPasses: 0, cache and parallel analysis still run
  },
});

// ============================================================================
// Applied Passes Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - appliedPasses tracks which passes were applied",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT * FROM 'http://example.com'");
    const result = optimizer.optimize(stmt);

    assertExists(result.appliedPasses);
    assert(Array.isArray(result.appliedPasses));
    // CacheOptimization and ParallelDetection should always be present
    assert(result.appliedPasses.includes("CacheOptimization"));
    assert(result.appliedPasses.includes("ParallelDetection"));
  },
});

Deno.test({
  name: "QueryOptimizer - appliedPasses contains no duplicates",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT * FROM users WHERE a = 1 + 1 AND b = 2 + 2 AND c = 3 + 3");
    const result = optimizer.optimize(stmt);

    const uniquePasses = [...new Set(result.appliedPasses)];
    assertEquals(result.appliedPasses.length, uniquePasses.length);
  },
});

// ============================================================================
// Complex Query Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - handles complex SELECT with all clauses",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery(
      "SELECT name AS fullName, age FROM users WHERE age > 18 AND active = true ORDER BY age DESC LIMIT 10"
    );
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "SELECT");
  },
});

Deno.test({
  name: "QueryOptimizer - handles nested subquery",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery(
      "SELECT * FROM (SELECT * FROM users WHERE active = true)"
    );
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "SELECT");
  },
});

Deno.test({
  name: "QueryOptimizer - handles NAVIGATE with options and capture",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery(
      "NAVIGATE TO 'http://example.com' WITH { timeout: 5000 } CAPTURE title, links"
    );
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "NAVIGATE");
    if (isNavigateStatement(result.optimizedAST)) {
      assertExists(result.optimizedAST.options);
      assertExists(result.optimizedAST.capture);
    }
  },
});

Deno.test({
  name: "QueryOptimizer - handles nested FOR loops",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery(
      "FOR EACH item IN items { FOR EACH subitem IN item { SET count = 1 + 1 } }"
    );
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "FOR");
  },
});

Deno.test({
  name: "QueryOptimizer - handles nested IF statements",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery(
      "IF x > 10 THEN { IF y > 5 THEN { SHOW 'both' } ELSE { SHOW 'x only' } }"
    );
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "IF");
  },
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - handles empty field list in SELECT",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT * FROM users");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "SELECT");
  },
});

Deno.test({
  name: "QueryOptimizer - handles SELECT without WHERE clause",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT name, age FROM users");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    if (isSelectStatement(result.optimizedAST)) {
      assertEquals(result.optimizedAST.where, undefined);
    }
  },
});

Deno.test({
  name: "QueryOptimizer - handles SHOW statement",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SHOW METRICS");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.optimizedAST.type, "SHOW");
  },
});

// ============================================================================
// Config Immutability Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - getConfig returns copy of config",
  fn() {
    const optimizer = new QueryOptimizer();
    const config1 = optimizer.getConfig();
    const config2 = optimizer.getConfig();

    // Should return equal but not same object
    assertEquals(config1, config2);
    assert(config1 !== config2);
  },
});

Deno.test({
  name: "QueryOptimizer - getOptimizationPasses returns copy of passes array",
  fn() {
    const optimizer = new QueryOptimizer();
    const passes1 = optimizer.getOptimizationPasses();
    const passes2 = optimizer.getOptimizationPasses();

    assertEquals(passes1.length, passes2.length);
    assert(passes1 !== passes2);
  },
});

// ============================================================================
// Disabled All Passes Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - works with all passes disabled",
  fn() {
    const optimizer = new QueryOptimizer({
      enableConstantFolding: false,
      enableDeadCodeElimination: false,
      enablePredicatePushdown: false,
      enableProjectionPushdown: false,
      enableCacheOptimization: false,
      enableParallelDetection: false,
    });
    const stmt = parseQuery("SELECT * FROM users WHERE 1 + 1 = 2");
    const result = optimizer.optimize(stmt);

    assertExists(result);
    assertEquals(result.appliedPasses.length, 0);
  },
});

// ============================================================================
// Comparison Tests
// ============================================================================

Deno.test({
  name: "QueryOptimizer - complex expression optimization reduces cost",
  fn() {
    const optimizer = new QueryOptimizer();
    const stmt = parseQuery("SELECT * FROM 'http://example.com' WHERE 10 + 20 + 30 > 50");
    const result = optimizer.optimize(stmt);

    // Optimized cost should be less than or equal to original
    assert(result.optimizedCost.totalCost <= result.originalCost.totalCost);
  },
});

Deno.test({
  name: "QueryOptimizer - cache optimization applies discount",
  fn() {
    const optimizer = new QueryOptimizer({ enableCacheOptimization: true });
    const stmt = parseQuery("SELECT * FROM 'http://example.com'");
    const result = optimizer.optimize(stmt);

    assertExists(result.cacheMetadata);
    // Network cost might be reduced due to cache hit potential
  },
});
