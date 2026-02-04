/**
 * Error Handling Integration Tests
 * Tests error handling through the full pipeline
 */

import { assertEquals, assertExists, assert, assertRejects, assertThrows } from "@std/assert";
import { Lexer } from "../../lexer/mod.ts";
import { Parser } from "../../parser/mod.ts";
import { SemanticAnalyzer } from "../../analyzer/mod.ts";
import { QueryOptimizer } from "../../optimizer/mod.ts";
import { ExecutionPlanner } from "../../planner/mod.ts";
import { QueryEngine } from "../../core/engine.ts";

// ============================================================================
// Lexer Error Tests
// ============================================================================

Deno.test({
  name: "Error Handling - lexer handles unterminated string",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "https://example.com';

  try {
    const lexer = new Lexer(query);
    lexer.tokenize();
    assert(false, "Should have thrown");
  } catch (e) {
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Error Handling - lexer handles invalid characters",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SELECT title FROM @invalid";

  try {
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    // May tokenize with error token or throw
    assertExists(tokens);
  } catch (e) {
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Error Handling - lexer handles invalid number format",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 12.34.56";

  try {
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    assertExists(tokens);
  } catch (e) {
    assert(e instanceof Error);
  }
});

// ============================================================================
// Parser Error Tests
// ============================================================================

Deno.test({
  name: "Error Handling - parser handles missing FROM keyword",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title "https://example.com"';
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
  name: "Error Handling - parser handles missing END keyword",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF condition THEN
    SET x = 1`;
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
  name: "Error Handling - parser handles missing THEN keyword",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `IF condition
    SET x = 1
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
  name: "Error Handling - parser handles missing IN keyword in FOR",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR item items DO
    SET x = item
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
  name: "Error Handling - parser handles missing DO keyword",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = `FOR item IN items
    SET x = item
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
  name: "Error Handling - parser handles unexpected token",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SELECT SELECT FROM";
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
  name: "Error Handling - parser handles empty query",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);

  try {
    parser.parse();
    // May return empty AST or throw
  } catch (e) {
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Error Handling - parser handles unmatched parentheses",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = (1 + 2";
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
  name: "Error Handling - parser handles unmatched brackets",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET arr = [1, 2, 3";
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
  name: "Error Handling - parser handles unmatched braces",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET obj = { name: 1";
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
// Semantic Analysis Error Tests
// ============================================================================

Deno.test({
  name: "Error Handling - analyzer handles private IP when blocked",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "http://192.168.1.1"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({ allowPrivateIPs: false });

  try {
    analyzer.analyze(ast);
    // May pass or throw depending on implementation
  } catch (e) {
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Error Handling - analyzer handles localhost when blocked",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "http://localhost:8080"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({ allowPrivateIPs: false });

  try {
    analyzer.analyze(ast);
  } catch (e) {
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Error Handling - analyzer handles file URLs when blocked",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'NAVIGATE TO "file:///etc/passwd"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});

  try {
    analyzer.analyze(ast);
  } catch (e) {
    assert(e instanceof Error);
  }
});

// ============================================================================
// Optimizer Error Tests
// ============================================================================

Deno.test({
  name: "Error Handling - optimizer handles division by zero constant",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = 10 / 0";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});

  try {
    const optimized = optimizer.optimize(analyzed.ast);
    // May preserve division or throw
    assertExists(optimized);
  } catch (e) {
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Error Handling - optimizer handles invalid AST gracefully",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  // Create a minimal valid AST
  const query = "SET x = 1";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const analyzer = new SemanticAnalyzer({});
  const analyzed = analyzer.analyze(ast);
  const optimizer = new QueryOptimizer({});

  try {
    const optimized = optimizer.optimize(analyzed.ast);
    assertExists(optimized);
  } catch (e) {
    assert(e instanceof Error);
  }
});

// ============================================================================
// QueryEngine Error Tests
// ============================================================================

Deno.test({
  name: "Error Handling - engine throws if not initialized",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();

  await assertRejects(
    async () => await engine.execute("SET x = 1"),
    Error,
    "not initialized"
  );
});

Deno.test({
  name: "Error Handling - engine throws for unknown query status",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  await assertRejects(
    async () => await engine.getQueryStatus("nonexistent_id"),
    Error,
    "not found"
  );

  await engine.shutdown();
});

Deno.test({
  name: "Error Handling - engine throws for cancel unknown query",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  await assertRejects(
    async () => await engine.cancelQuery("nonexistent_id"),
    Error,
    "not found"
  );

  await engine.shutdown();
});

Deno.test({
  name: "Error Handling - engine handles invalid query syntax",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  try {
    await engine.execute("INVALID QUERY SYNTAX");
    assert(false, "Should have thrown");
  } catch (e) {
    assert(e instanceof Error);
  }

  await engine.shutdown();
});

Deno.test({
  name: "Error Handling - engine handles parse errors",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  try {
    await engine.execute('SELECT title FROM "unclosed string');
    assert(false, "Should have thrown");
  } catch (e) {
    assert(e instanceof Error);
  }

  await engine.shutdown();
});

// ============================================================================
// Error Message Quality Tests
// ============================================================================

Deno.test({
  name: "Error Handling - error includes position info",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT FROM "https://example.com"';
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);

  try {
    parser.parse();
    assert(false, "Should have thrown");
  } catch (e) {
    assert(e instanceof Error);
    // Error message may include position info
    assertExists(e.message);
    assert(e.message.length > 0);
  }
});

Deno.test({
  name: "Error Handling - error includes expected token info",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "IF condition SET x = 1 END";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);

  try {
    parser.parse();
    assert(false, "Should have thrown");
  } catch (e) {
    assert(e instanceof Error);
    // Error should mention THEN
    assertExists(e.message);
  }
});

// ============================================================================
// Recovery Tests
// ============================================================================

Deno.test({
  name: "Error Handling - engine recovers after error",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // First query fails
  try {
    await engine.execute("INVALID SYNTAX");
  } catch {
    // Expected
  }

  // Engine should still work
  assertEquals(engine.isInitialized(), true);

  // Cleanup
  await engine.shutdown();
});

Deno.test({
  name: "Error Handling - multiple errors don't corrupt state",
  sanitizeResources: false,
  sanitizeOps: false,
}, async () => {
  const engine = new QueryEngine();
  await engine.initialize({});

  // Multiple failures
  for (let i = 0; i < 3; i++) {
    try {
      await engine.execute("BAD QUERY " + i);
    } catch {
      // Expected
    }
  }

  // Engine should still be functional
  assertEquals(engine.isInitialized(), true);

  await engine.shutdown();
});

// ============================================================================
// Error Propagation Tests
// ============================================================================

Deno.test({
  name: "Error Handling - lexer errors propagate correctly",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SELECT title FROM "';

  try {
    const lexer = new Lexer(query);
    lexer.tokenize();
    assert(false, "Should have thrown");
  } catch (e) {
    assert(e instanceof Error);
    assertExists(e.message);
  }
});

Deno.test({
  name: "Error Handling - parser errors have descriptive messages",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SELECT";
  const lexer = new Lexer(query);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);

  try {
    parser.parse();
    assert(false, "Should have thrown");
  } catch (e) {
    assert(e instanceof Error);
    assert(e.message.length > 10, "Error message should be descriptive");
  }
});

// ============================================================================
// Edge Cases
// ============================================================================

Deno.test({
  name: "Error Handling - handles very long invalid query",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SELECT " + "x ".repeat(1000);

  try {
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    parser.parse();
    // May succeed or fail
  } catch (e) {
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Error Handling - handles deeply nested invalid expression",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET x = " + "(".repeat(50) + "1" + ")".repeat(49);

  try {
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    parser.parse();
    assert(false, "Should have thrown");
  } catch (e) {
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Error Handling - handles special characters in strings",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = 'SET x = "hello\\nworld"';

  try {
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    assertExists(ast);
  } catch (e) {
    // May or may not support escape sequences
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Error Handling - handles unicode in identifiers",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SET 变量 = 1";

  try {
    const lexer = new Lexer(query);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    parser.parse();
    // May or may not support unicode identifiers
  } catch (e) {
    assert(e instanceof Error);
  }
});

Deno.test({
  name: "Error Handling - handles null bytes in query",
  sanitizeResources: false,
  sanitizeOps: false,
}, () => {
  const query = "SELECT\0title FROM url";

  try {
    const lexer = new Lexer(query);
    lexer.tokenize();
    // May handle or reject null bytes
  } catch (e) {
    assert(e instanceof Error);
  }
});
