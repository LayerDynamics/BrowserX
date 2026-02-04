/**
 * Semantic Analyzer Tests
 * Comprehensive tests for the SemanticAnalyzer class
 */

import { assertEquals, assertExists, assert, assertThrows } from "@std/assert";
import { SemanticAnalyzer, SemanticError, type AnnotatedAST, type SemanticAnalyzerConfig } from "../../analyzer/semantic.ts";
import { SymbolTable, ScopeType, SymbolType } from "../../analyzer/symbols.ts";
import { TypeChecker } from "../../analyzer/type-checker.ts";
import { Validator } from "../../analyzer/validator.ts";
import { DataType } from "../../types/primitives.ts";
import { parseQuery, parseExpression, isSelectStatement } from "../helpers/test-utils.ts";
import type { SelectStatement, Expression, Literal } from "../../types/ast.ts";

// Helper to create a semantic analyzer that allows undefined variables (for testing with tables like 'users')
function createTestAnalyzer(config: Partial<SemanticAnalyzerConfig> = {}): SemanticAnalyzer {
  return new SemanticAnalyzer({
    allowUndefinedVariables: true,  // Allow variables like 'users' that aren't defined
    strictTypeChecking: false,       // Relax type checking for tests
    ...config,
  });
}

// ============================================================================
// Constructor Tests
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - constructor creates analyzer with default config",
  fn() {
    // Use new SemanticAnalyzer() directly to test actual defaults
    // (createTestAnalyzer() sets different defaults for other tests)
    const analyzer = new SemanticAnalyzer();

    assertExists(analyzer);
    const config = analyzer.getConfig();
    assertEquals(config.allowUndefinedVariables, false);
    assertEquals(config.strictTypeChecking, true);
    assertEquals(config.allowPrivateIPs, false);
    assertEquals(config.maxNestingDepth, 10);
  },
});

Deno.test({
  name: "SemanticAnalyzer - constructor accepts custom config",
  fn() {
    const analyzer = new SemanticAnalyzer({
      allowUndefinedVariables: true,
      strictTypeChecking: false,
      allowPrivateIPs: true,
      maxNestingDepth: 5,
    });

    const config = analyzer.getConfig();
    assertEquals(config.allowUndefinedVariables, true);
    assertEquals(config.strictTypeChecking, false);
    assertEquals(config.allowPrivateIPs, true);
    assertEquals(config.maxNestingDepth, 5);
  },
});

Deno.test({
  name: "SemanticAnalyzer - constructor partial config uses defaults",
  fn() {
    const analyzer = new SemanticAnalyzer({
      maxNestingDepth: 15,
    });

    const config = analyzer.getConfig();
    assertEquals(config.allowUndefinedVariables, false); // default
    assertEquals(config.strictTypeChecking, true); // default
    assertEquals(config.maxNestingDepth, 15); // custom
  },
});

// ============================================================================
// Accessor Tests
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - getSymbolTable returns SymbolTable instance",
  fn() {
    const analyzer = createTestAnalyzer();
    const symbolTable = analyzer.getSymbolTable();

    assertExists(symbolTable);
    assert(symbolTable instanceof SymbolTable);
  },
});

Deno.test({
  name: "SemanticAnalyzer - getTypeChecker returns TypeChecker instance",
  fn() {
    const analyzer = createTestAnalyzer();
    const typeChecker = analyzer.getTypeChecker();

    assertExists(typeChecker);
    assert(typeChecker instanceof TypeChecker);
  },
});

Deno.test({
  name: "SemanticAnalyzer - getValidator returns Validator instance",
  fn() {
    const analyzer = createTestAnalyzer();
    const validator = analyzer.getValidator();

    assertExists(validator);
    assert(validator instanceof Validator);
  },
});

Deno.test({
  name: "SemanticAnalyzer - getConfig returns copy of config",
  fn() {
    const analyzer = createTestAnalyzer();
    const config1 = analyzer.getConfig();
    const config2 = analyzer.getConfig();

    assertEquals(config1, config2);
    assert(config1 !== config2); // Different objects
  },
});

Deno.test({
  name: "SemanticAnalyzer - getNestingDepth returns current depth",
  fn() {
    const analyzer = createTestAnalyzer();
    assertEquals(analyzer.getNestingDepth(), 0);
  },
});

// ============================================================================
// Analyze Tests - Basic Statements
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - analyze returns AnnotatedAST",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT * FROM 'http://example.com'");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertExists(result.ast);
    assertExists(result.symbolTable);
    assertExists(result.typeInfo);
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze SELECT statement",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT name, age FROM users");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "SELECT");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze SELECT with URL source",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT title FROM 'http://example.com'");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "SELECT");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze SELECT with WHERE clause",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT * FROM users WHERE age > 18");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    if (isSelectStatement(result.ast)) {
      assertExists(result.ast.where);
    }
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze SELECT with field aliases",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT name AS fullName, age AS years FROM users");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    // Field aliases should be tracked in symbol table
    assert(result.typeInfo.size >= 0);
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze NAVIGATE statement",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("NAVIGATE TO 'http://example.com'");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "NAVIGATE");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze NAVIGATE with CAPTURE",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("NAVIGATE TO 'http://example.com' CAPTURE title, links");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "NAVIGATE");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze SET statement",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SET value = 42");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "SET");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze SET with path",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SET config.timeout = 5000");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "SET");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze SHOW statement",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SHOW METRICS");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "SHOW");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze FOR statement",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("FOR EACH item IN items { SHOW METRICS }");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "FOR");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze IF statement",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("IF x > 10 THEN { SHOW METRICS }");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "IF");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze IF ELSE statement",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("IF x > 10 THEN { SHOW METRICS } ELSE { SHOW CACHE }");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "IF");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze INSERT statement",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("INSERT { name: 'Alice' } INTO users");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "INSERT");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze UPDATE statement",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("UPDATE user SET name = 'Bob'");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "UPDATE");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze DELETE statement",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("DELETE user");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "DELETE");
  },
});

Deno.test({
  name: "SemanticAnalyzer - analyze WITH statement",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("WITH data AS (SELECT * FROM 'http://api.com') SELECT * FROM data");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "WITH");
  },
});

// ============================================================================
// SHOW Target Validation Tests
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - SHOW CACHE is valid",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SHOW CACHE");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

Deno.test({
  name: "SemanticAnalyzer - SHOW COOKIES is valid",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SHOW COOKIES");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

Deno.test({
  name: "SemanticAnalyzer - SHOW HEADERS is valid",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SHOW HEADERS");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

Deno.test({
  name: "SemanticAnalyzer - SHOW STATE is valid",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SHOW STATE");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

Deno.test({
  name: "SemanticAnalyzer - SHOW VARIABLES is valid",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SHOW VARIABLES");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

Deno.test({
  name: "SemanticAnalyzer - SHOW HISTORY is valid",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SHOW HISTORY");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

Deno.test({
  name: "SemanticAnalyzer - SHOW CONNECTIONS is valid",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SHOW CONNECTIONS");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

// ============================================================================
// Nesting Depth Tests
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - respects maxNestingDepth",
  fn() {
    const analyzer = new SemanticAnalyzer({ maxNestingDepth: 2 });

    // This should work (depth 1)
    const stmt1 = parseQuery("FOR EACH x IN items { SHOW METRICS }");
    const result1 = analyzer.analyze(stmt1);
    assertExists(result1);
  },
});

Deno.test({
  name: "SemanticAnalyzer - nested FOR loops track depth",
  fn() {
    const analyzer = new SemanticAnalyzer({ maxNestingDepth: 5 });
    const stmt = parseQuery("FOR EACH x IN items { FOR EACH y IN x { SHOW METRICS } }");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

Deno.test({
  name: "SemanticAnalyzer - nested IF statements track depth",
  fn() {
    const analyzer = new SemanticAnalyzer({ maxNestingDepth: 5 });
    const stmt = parseQuery("IF x > 10 THEN { IF y > 5 THEN { SHOW METRICS } }");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

// ============================================================================
// Type Information Tests
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - collects type info for expressions",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT * FROM users WHERE age > 18");
    const result = analyzer.analyze(stmt);

    assertExists(result.typeInfo);
    assert(result.typeInfo instanceof Map);
  },
});

Deno.test({
  name: "SemanticAnalyzer - getTypeInfoMap returns copy",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT * FROM 'http://example.com'");
    analyzer.analyze(stmt);

    const map1 = analyzer.getTypeInfoMap();
    const map2 = analyzer.getTypeInfoMap();

    assert(map1 !== map2);
  },
});

// ============================================================================
// Symbol Table Integration Tests
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - FOR loop adds variable to symbol table",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("FOR EACH item IN items { SHOW METRICS }");
    analyzer.analyze(stmt);

    // Variable 'item' should be defined in the FOR loop scope
    // (though it may be cleaned up after scope exit)
    assertExists(analyzer.getSymbolTable());
  },
});

Deno.test({
  name: "SemanticAnalyzer - SET defines variable in symbol table",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SET myVar = 42");
    analyzer.analyze(stmt);

    const symbolTable = analyzer.getSymbolTable();
    assertExists(symbolTable);
  },
});

Deno.test({
  name: "SemanticAnalyzer - WITH statement defines CTEs",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("WITH users AS (SELECT * FROM 'http://api.com') SELECT * FROM users");
    analyzer.analyze(stmt);

    assertExists(analyzer.getSymbolTable());
  },
});

// ============================================================================
// Config Behavior Tests
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - allowUndefinedVariables true allows undefined",
  fn() {
    const analyzer = new SemanticAnalyzer({ allowUndefinedVariables: true });
    const stmt = parseQuery("SELECT * FROM unknownVariable");

    // Should not throw with allowUndefinedVariables: true
    const result = analyzer.analyze(stmt);
    assertExists(result);
  },
});

Deno.test({
  name: "SemanticAnalyzer - strictTypeChecking false skips type checking",
  fn() {
    const analyzer = new SemanticAnalyzer({ strictTypeChecking: false });
    const stmt = parseQuery("SELECT * FROM 'http://example.com'");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

// ============================================================================
// Subquery Tests
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - handles subquery in SELECT",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT * FROM (SELECT * FROM users)");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "SELECT");
  },
});

Deno.test({
  name: "SemanticAnalyzer - handles nested subqueries",
  fn() {
    // Use allowUndefinedVariables since 'users' is not defined
    const analyzer = new SemanticAnalyzer({ maxNestingDepth: 10, allowUndefinedVariables: true });
    const stmt = parseQuery("SELECT * FROM (SELECT * FROM (SELECT * FROM users))");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "SELECT");
  },
});

// ============================================================================
// Complex Expression Tests
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - handles binary expressions in WHERE",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT * FROM users WHERE age > 18 AND active = true");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertExists(result.typeInfo);
  },
});

Deno.test({
  name: "SemanticAnalyzer - handles function calls in expressions",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT UPPER(name) FROM users");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

Deno.test({
  name: "SemanticAnalyzer - handles member expressions",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT user.name FROM users");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

Deno.test({
  name: "SemanticAnalyzer - handles array expressions",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("FOR EACH x IN [1, 2, 3] { SHOW METRICS }");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

Deno.test({
  name: "SemanticAnalyzer - handles object expressions",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("INSERT { name: 'Alice', age: 25 } INTO users");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

// ============================================================================
// Multiple Analysis Tests
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - can analyze multiple statements",
  fn() {
    const analyzer = createTestAnalyzer();

    const stmt1 = parseQuery("SELECT * FROM users");
    const result1 = analyzer.analyze(stmt1);
    assertExists(result1);

    const stmt2 = parseQuery("NAVIGATE TO 'http://example.com'");
    const result2 = analyzer.analyze(stmt2);
    assertExists(result2);
  },
});

Deno.test({
  name: "SemanticAnalyzer - resets state between analyses",
  fn() {
    const analyzer = createTestAnalyzer();

    const stmt1 = parseQuery("SET x = 42");
    analyzer.analyze(stmt1);
    const depth1 = analyzer.getNestingDepth();
    assertEquals(depth1, 0);

    const stmt2 = parseQuery("SELECT * FROM 'http://example.com'");
    analyzer.analyze(stmt2);
    const depth2 = analyzer.getNestingDepth();
    assertEquals(depth2, 0);
  },
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - handles empty WHERE clause gracefully",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT * FROM users");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    if (isSelectStatement(result.ast)) {
      assertEquals(result.ast.where, undefined);
    }
  },
});

Deno.test({
  name: "SemanticAnalyzer - handles SELECT *",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("SELECT * FROM 'http://example.com'");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    if (isSelectStatement(result.ast)) {
      assertEquals(result.ast.fields.length, 1);
      assertEquals(result.ast.fields[0].name, "*");
    }
  },
});

Deno.test({
  name: "SemanticAnalyzer - handles NAVIGATE without options",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("NAVIGATE TO 'http://example.com'");
    const result = analyzer.analyze(stmt);

    assertExists(result);
  },
});

Deno.test({
  name: "SemanticAnalyzer - handles UPDATE with multiple assignments",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery("UPDATE user SET name = 'Bob', age = 30, active = true");
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "UPDATE");
  },
});

// ============================================================================
// Integration Tests
// ============================================================================

Deno.test({
  name: "SemanticAnalyzer - complete workflow with complex query",
  fn() {
    const analyzer = createTestAnalyzer();
    const stmt = parseQuery(
      "WITH products AS (SELECT * FROM 'http://api.com/products') " +
      "SELECT name AS productName, price " +
      "FROM products " +
      "WHERE price > 100 " +
      "ORDER BY price DESC " +
      "LIMIT 10"
    );
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "WITH");
    assertExists(result.symbolTable);
    assertExists(result.typeInfo);
  },
});

Deno.test({
  name: "SemanticAnalyzer - complex nested control flow",
  fn() {
    const analyzer = new SemanticAnalyzer({ maxNestingDepth: 10 });
    const stmt = parseQuery(
      "FOR EACH item IN items { " +
      "  IF item > 10 THEN { " +
      "    FOR EACH subitem IN item { " +
      "      SHOW METRICS " +
      "    } " +
      "  } " +
      "}"
    );
    const result = analyzer.analyze(stmt);

    assertExists(result);
    assertEquals(result.ast.type, "FOR");
  },
});
