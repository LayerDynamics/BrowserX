/**
 * Export Verification Script
 * Tests that all critical components can be imported from main mod.ts
 */

import {
  // Core
  QueryEngine,

  // Lexer
  Lexer,
  TokenType,

  // Parser
  Parser,

  // Analyzer
  SemanticAnalyzer,
  SymbolTable,
  TypeChecker,

  // Optimizer
  QueryOptimizer,
  CostEstimator,

  // Planner
  ExecutionPlanner,
  DependencyGraphBuilder,

  // Executor
  QueryExecutor,
  ExecutionContextManager,
  ExpressionEvaluator,
  StepExecutor,

  // State Management
  StateManager,
  QueryCacheManager,
  SessionStateManager,
  BrowserStateTracker,
  VariableScope,

  // Controllers
  BrowserController,
  ProxyController,

  // Schema & Functions
  FunctionRegistry,

  // Formatter
  ResultFormatter,

  // Security
  SecurityValidator,

  // Metrics
  MetricsCollector,
} from "./mod.ts";

console.log("✓ Export Verification Starting...\n");

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
    failed++;
  }
}

// Test Core Pipeline
test("QueryEngine is exported", () => {
  if (typeof QueryEngine !== "function") throw new Error("Not a constructor");
});

test("Lexer is exported", () => {
  if (typeof Lexer !== "function") throw new Error("Not a constructor");
});

test("TokenType is exported", () => {
  if (typeof TokenType !== "object") throw new Error("Not an enum object");
});

test("Parser is exported", () => {
  if (typeof Parser !== "function") throw new Error("Not a constructor");
});

test("SemanticAnalyzer is exported", () => {
  if (typeof SemanticAnalyzer !== "function") throw new Error("Not a constructor");
});

test("SymbolTable is exported", () => {
  if (typeof SymbolTable !== "function") throw new Error("Not a constructor");
});

test("TypeChecker is exported", () => {
  if (typeof TypeChecker !== "function") throw new Error("Not a constructor");
});

test("QueryOptimizer is exported", () => {
  if (typeof QueryOptimizer !== "function") throw new Error("Not a constructor");
});

test("CostEstimator is exported", () => {
  if (typeof CostEstimator !== "function") throw new Error("Not a constructor");
});

test("ExecutionPlanner is exported", () => {
  if (typeof ExecutionPlanner !== "function") throw new Error("Not a constructor");
});

test("DependencyGraphBuilder is exported", () => {
  if (typeof DependencyGraphBuilder !== "function") throw new Error("Not a constructor");
});

test("QueryExecutor is exported", () => {
  if (typeof QueryExecutor !== "function") throw new Error("Not a constructor");
});

// Test Internal Components
test("ExecutionContextManager is exported", () => {
  if (typeof ExecutionContextManager !== "function") throw new Error("Not a constructor");
});

test("ExpressionEvaluator is exported", () => {
  if (typeof ExpressionEvaluator !== "function") throw new Error("Not a constructor");
});

test("StepExecutor is exported", () => {
  if (typeof StepExecutor !== "function") throw new Error("Not a constructor");
});

// Test State Management
test("StateManager is exported", () => {
  if (typeof StateManager !== "function") throw new Error("Not a constructor");
});

test("QueryCacheManager is exported", () => {
  if (typeof QueryCacheManager !== "function") throw new Error("Not a constructor");
});

test("SessionStateManager is exported", () => {
  if (typeof SessionStateManager !== "function") throw new Error("Not a constructor");
});

test("BrowserStateTracker is exported", () => {
  if (typeof BrowserStateTracker !== "function") throw new Error("Not a constructor");
});

test("VariableScope is exported", () => {
  if (typeof VariableScope !== "function") throw new Error("Not a constructor");
});

// Test Controllers
test("BrowserController is exported", () => {
  if (typeof BrowserController !== "function") throw new Error("Not a constructor");
});

test("ProxyController is exported", () => {
  if (typeof ProxyController !== "function") throw new Error("Not a constructor");
});

// Test Utilities
test("FunctionRegistry is exported", () => {
  if (typeof FunctionRegistry !== "function") throw new Error("Not a constructor");
});

test("ResultFormatter is exported", () => {
  if (typeof ResultFormatter !== "function") throw new Error("Not a constructor");
});

test("SecurityValidator is exported", () => {
  if (typeof SecurityValidator !== "function") throw new Error("Not a constructor");
});

test("MetricsCollector is exported", () => {
  if (typeof MetricsCollector !== "function") throw new Error("Not a constructor");
});

// Test Instantiation
test("Can instantiate Lexer", () => {
  const lexer = new Lexer("SELECT * FROM page");
  if (!lexer) throw new Error("Failed to instantiate");
});

test("Can instantiate Parser", () => {
  const lexer = new Lexer("SELECT * FROM page");
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  if (!parser) throw new Error("Failed to instantiate");
});

test("Can instantiate SymbolTable", () => {
  const symbolTable = new SymbolTable();
  if (!symbolTable) throw new Error("Failed to instantiate");
});

test("Can instantiate QueryCacheManager", () => {
  const cache = new QueryCacheManager({ maxSize: 1024 * 1024 });
  if (!cache) throw new Error("Failed to instantiate");
});

test("Can instantiate VariableScope", () => {
  const scope = new VariableScope();
  if (!scope) throw new Error("Failed to instantiate");
});

test("Can instantiate FunctionRegistry", () => {
  const registry = new FunctionRegistry();
  if (!registry) throw new Error("Failed to instantiate");
});

test("Can instantiate ResultFormatter", () => {
  const formatter = new ResultFormatter();
  if (!formatter) throw new Error("Failed to instantiate");
});

test("Can instantiate MetricsCollector", () => {
  const metrics = new MetricsCollector();
  if (!metrics) throw new Error("Failed to instantiate");
});

// Results
console.log("\n" + "=".repeat(50));
console.log(`Export Verification Complete`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log("=".repeat(50));

if (failed > 0) {
  Deno.exit(1);
}
